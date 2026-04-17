import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../services/firebaseConfig";

export const createAnnouncement = async (payload: {
  createdBy: string;
  title: string;
  body: string;
  isPinned?: boolean;
}) => {
  const trimmedTitle = payload.title.trim();
  const trimmedBody = payload.body.trim();

  if (!trimmedTitle || !trimmedBody) {
    throw new Error("Announcement title and message are required.");
  }

  const announcementRef = await addDoc(collection(db, "announcements"), {
    title: trimmedTitle,
    body: trimmedBody,
    isPinned: Boolean(payload.isPinned),
    status: "active",
    createdBy: payload.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const usersSnap = await getDocs(collection(db, "users"));
  if (!usersSnap.empty) {
    const batch = writeBatch(db);
    usersSnap.docs.forEach((userDoc) => {
      const role = String(userDoc.data()?.role || "").toLowerCase();
      if (role.includes("admin")) return;
      const notifRef = doc(collection(db, "notifications"));
      batch.set(notifRef, {
        userId: userDoc.id,
        type: "announcement_new",
        title: `Announcement: ${trimmedTitle}`,
        body: trimmedBody,
        data: { announcementId: announcementRef.id },
        read: false,
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return announcementRef.id;
};
