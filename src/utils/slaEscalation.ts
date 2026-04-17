import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../services/firebaseConfig";
import { getRequestSlaState } from "./requestSla";

type RequestLike = {
  id: string;
  status?: string;
  urgency?: string;
  patientName?: string;
  createdAt?: any;
  slaDeadlineAt?: any;
};

export const shouldEscalateRequest = (request: RequestLike, now: Date = new Date()) => {
  const status = String(request.status || "").toLowerCase();
  if (status !== "pending") return false;

  const urgency = String(request.urgency || "Normal");
  if (urgency === "Critical") return false;

  const slaState = getRequestSlaState(request, now);
  if (slaState.isBreached) return true;
  const minutesLeft = Math.floor(slaState.remainingMs / 60000);
  return minutesLeft <= 10;
};

const getEscalatedUrgency = (urgency: string | undefined) => {
  const normalized = String(urgency || "Normal");
  if (normalized === "Normal") return "Urgent";
  if (normalized === "Urgent") return "Critical";
  return "Critical";
};

export const autoEscalatePendingRequests = async (adminId: string) => {
  const snapshot = await getDocs(query(collection(db, "requests"), where("status", "==", "pending")));
  const now = new Date();
  const targets = snapshot.docs
    .map((item) => ({ id: item.id, ...(item.data() as any) }) as RequestLike)
    .filter((item) => shouldEscalateRequest(item, now));

  for (const requestItem of targets) {
    const nextUrgency = getEscalatedUrgency(requestItem.urgency);
    await updateDoc(doc(db, "requests", requestItem.id), {
      urgency: nextUrgency,
      escalatedBy: adminId,
      escalatedAt: serverTimestamp(),
      escalationReason: "sla_threshold",
      escalationSource: "auto_escalation",
      escalationCount: (Number((requestItem as any)?.escalationCount) || 0) + 1,
    });
  }

  return {
    escalatedCount: targets.length,
    escalatedRequestIds: targets.map((item) => item.id),
  };
};

