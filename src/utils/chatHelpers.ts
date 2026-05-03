import { arrayRemove, doc, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";

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
  const participants = [uid1, uid2].sort();
  const conversationRef = doc(db, "conversations", conversationId);

  try {
    await setDoc(
      conversationRef,
      {
        updatedAt: serverTimestamp(),
        hiddenFor: arrayRemove(uid1, uid2),
      },
      { merge: true }
    );
  } catch (error: any) {
    const errorCode = String(error?.code || "");
    if (errorCode !== "not-found" && errorCode !== "permission-denied") {
      throw error;
    }

    await setDoc(conversationRef, {
      participants,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return conversationId;
};
