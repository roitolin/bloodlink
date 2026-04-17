import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../services/firebaseConfig";
import { createAdminNotification } from "./createAdminNotification";

export type BlockState = {
  blockedByMe: boolean;
  blockedMe: boolean;
  blockedEitherWay: boolean;
};

export const getUserBlockDocId = (blockerId: string, blockedId: string) => `${blockerId}__${blockedId}`;

export const getBlockStateBetweenUsers = async (currentUserId: string, otherUserId: string): Promise<BlockState> => {
  const [blockedByMeSnap, blockedMeSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, "user_blocks"),
        where("blockerId", "==", currentUserId),
        where("blockedId", "==", otherUserId),
        limit(1)
      )
    ),
    getDocs(
      query(
        collection(db, "user_blocks"),
        where("blockerId", "==", otherUserId),
        where("blockedId", "==", currentUserId),
        limit(1)
      )
    ),
  ]);

  const blockedByMe = !blockedByMeSnap.empty && blockedByMeSnap.docs[0]?.data()?.active !== false;
  const blockedMe = !blockedMeSnap.empty && blockedMeSnap.docs[0]?.data()?.active !== false;

  return {
    blockedByMe,
    blockedMe,
    blockedEitherWay: blockedByMe || blockedMe,
  };
};

export const blockUser = async (blockerId: string, blockedId: string, reason = "safety") => {
  if (blockerId === blockedId) {
    throw new Error("You cannot block your own account.");
  }

  const blockedUserSnap = await getDoc(doc(db, "users", blockedId));
  const blockedUserRole = String(blockedUserSnap.data()?.role || "").toLowerCase();
  if (blockedUserRole === "admin") {
    throw new Error("You cannot block admin accounts.");
  }

  const ref = doc(db, "user_blocks", getUserBlockDocId(blockerId, blockedId));
  await setDoc(ref, {
    blockerId,
    blockedId,
    reason,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const unblockUser = async (blockerId: string, blockedId: string) => {
  await deleteDoc(doc(db, "user_blocks", getUserBlockDocId(blockerId, blockedId)));
};

export const reportUserAbuse = async (payload: {
  reporterId: string;
  targetUserId: string;
  reporterName?: string | null;
  targetName?: string | null;
  reason: string;
  details?: string;
  evidenceURL?: string | null;
  source?: string;
  requestId?: string;
  conversationId?: string;
}) => {
  const reportRef = await addDoc(collection(db, "abuse_reports"), {
    reporterId: payload.reporterId,
    targetUserId: payload.targetUserId,
    reporterName: payload.reporterName || null,
    targetName: payload.targetName || null,
    reason: payload.reason,
    details: payload.details || null,
    evidenceURL: payload.evidenceURL || null,
    source: payload.source || "app",
    requestId: payload.requestId || null,
    conversationId: payload.conversationId || null,
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await createAdminNotification(
    "abuse_report",
    "New Abuse Report",
    `A user submitted an abuse report: ${payload.reason}`,
    {
      reportId: reportRef.id,
      reporterId: payload.reporterId,
      targetUserId: payload.targetUserId,
      source: payload.source || "app",
    }
  );

  return reportRef.id;
};
