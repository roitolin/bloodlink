import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../services/firebaseConfig";

let adminId: string | null = null;

export const getAdminId = async (): Promise<string | null> => {
  if (adminId) return adminId;

  try {
    // Primary source (if configured): settings/admin { userId: "<adminUid>" }.
    const docSnap = await getDoc(doc(db, "settings", "admin"));
    if (docSnap.exists()) {
      adminId = docSnap.data().userId;
      if (adminId) return adminId;
    }
  } catch {
    // Ignore missing permissions on /settings and fallback below.
  }

  // Fallback source: first user with role=admin.
  try {
    const q = query(collection(db, "users"), where("role", "==", "admin"), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      adminId = snapshot.docs[0].id;
    }
  } catch {
    // Keep silent to avoid noisy logs in production UI.
  }

  return adminId;
};
