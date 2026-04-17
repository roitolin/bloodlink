import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../services/firebaseConfig";

type EmergencyUrgency = "Critical" | "Urgent" | "Normal";

type BroadcastPayload = {
  message: string;
  urgency?: EmergencyUrgency;
  targetCity?: string;
  targetBloodType?: string;
  expiresInHours?: number;
  createdBy: string;
  createdByName?: string;
};

type UserRecord = {
  id: string;
  role?: string;
  city?: string;
  bloodType?: string;
};

const normalize = (value: string | undefined | null) => String(value || "").trim().toLowerCase();

const isAdminRole = (role: string | undefined) => normalize(role).includes("admin");

const userMatchesBroadcastTarget = (user: UserRecord, targetCity: string, targetBloodType: string) => {
  if (targetCity && normalize(user.city) !== targetCity) return false;
  if (targetBloodType && normalize(user.bloodType) !== targetBloodType) return false;
  return true;
};

export const createEmergencyBroadcast = async ({
  message,
  urgency = "Critical",
  targetCity = "",
  targetBloodType = "",
  expiresInHours = 6,
  createdBy,
  createdByName,
}: BroadcastPayload) => {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    throw new Error("Emergency broadcast message is required.");
  }

  const safeExpiresInHours = Number.isFinite(expiresInHours)
    ? Math.min(72, Math.max(1, Math.round(expiresInHours)))
    : 6;
  const expiresAt = new Date(Date.now() + safeExpiresInHours * 3600000);
  const normalizedTargetCity = targetCity.trim();
  const normalizedTargetBloodType = targetBloodType.trim();

  const broadcastRef = await addDoc(collection(db, "emergency_broadcasts"), {
    message: trimmedMessage,
    urgency,
    status: "active",
    targetCity: normalizedTargetCity || null,
    targetBloodType: normalizedTargetBloodType || null,
    createdBy,
    createdByName: createdByName || null,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
  });

  const usersSnap = await getDocs(collection(db, "users"));
  const users = usersSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) })) as UserRecord[];
  const cityFilter = normalize(normalizedTargetCity);
  const bloodTypeFilter = normalize(normalizedTargetBloodType);

  const recipients = users.filter((user) => {
    if (user.id === createdBy) return false;
    if (isAdminRole(user.role)) return false;
    return userMatchesBroadcastTarget(user, cityFilter, bloodTypeFilter);
  });

  if (recipients.length > 0) {
    const batch = writeBatch(db);
    recipients.forEach((recipient) => {
      const notifRef = doc(collection(db, "notifications"));
      batch.set(notifRef, {
        userId: recipient.id,
        type: "emergency_broadcast",
        title: `${urgency} Blood Alert`,
        body: trimmedMessage,
        data: {
          broadcastId: broadcastRef.id,
          urgency,
          targetCity: normalizedTargetCity || null,
          targetBloodType: normalizedTargetBloodType || null,
        },
        read: false,
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return { broadcastId: broadcastRef.id, recipientCount: recipients.length, expiresAt };
};
