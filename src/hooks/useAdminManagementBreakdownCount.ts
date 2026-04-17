import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";

type Breakdown = {
  donors: number;
  requests: number;
  total: number;
};

export function useAdminManagementBreakdownCount() {
  const [counts, setCounts] = useState<Breakdown>({ donors: 0, requests: 0, total: 0 });
  const adminId = auth.currentUser?.uid;

  useEffect(() => {
    if (!adminId) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", adminId),
      where("read", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let donors = 0;
      let requests = 0;

      snapshot.docs.forEach((notificationDoc) => {
        const type = notificationDoc.data().type;
        if (type === "donor_pending") donors += 1;
        if (type === "request_pending") requests += 1;
      });

      setCounts({ donors, requests, total: donors + requests });
    });

    return unsubscribe;
  }, [adminId]);

  return counts;
}

