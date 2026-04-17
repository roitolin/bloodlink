import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebaseConfig";
import { getAdminId } from "./adminConfig";

export type AdminNotificationType =
  | "donor_pending"
  | "request_pending"
  | "support_message"
  | "feedback_new"
  | "rating_update"
  | "abuse_report";

export const createAdminNotification = async (
  type: AdminNotificationType,
  title: string,
  body: string,
  data?: any
) => {
  const adminId = await getAdminId();
  if (!adminId) return;

  try {
    await addDoc(collection(db, "notifications"), {
      userId: adminId,
      type,
      title,
      body,
      data: data || null,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error creating admin notification:", error);
  }
};
