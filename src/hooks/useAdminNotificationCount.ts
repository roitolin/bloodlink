import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";

export function useAdminNotificationCount() {
  const [unreadCount, setUnreadCount] = useState(0);
  const adminId = auth.currentUser?.uid;

  useEffect(() => {
    if (!adminId) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", adminId),
      where("read", "==", false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });
    return unsubscribe;
  }, [adminId]);

  return unreadCount;
}