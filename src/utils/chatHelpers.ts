import { doc, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";

/**
 * Creates a deterministic conversation ID based on two user IDs.
 * The IDs are sorted alphabetically to ensure the same ID regardless of order.
 */
export const getConversationId = (uid1: string, uid2: string): string => {
  return [uid1, uid2].sort().join('_');
};

/**
 * Ensures a conversation document exists and keeps participants normalized.
 */
export const ensureConversationForUsers = async (
  db: Firestore,
  uid1: string,
  uid2: string
): Promise<string> => {
  const conversationId = getConversationId(uid1, uid2);
  await setDoc(
    doc(db, "conversations", conversationId),
    {
      participants: [uid1, uid2].sort(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return conversationId;
};
