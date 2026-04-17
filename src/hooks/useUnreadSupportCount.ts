import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";

export function useUnreadSupportCount() {
  const [unreadCount, setUnreadCount] = useState(0);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const lastMessage = data.lastMessage;
        if (
          lastMessage &&
          lastMessage.senderId !== userId &&
          (!lastMessage.readBy || !lastMessage.readBy.includes(userId))
        ) {
          count++;
        }
      });
      setUnreadCount(count);
    });

    return unsubscribe;
  }, [userId]);

  return unreadCount;
}