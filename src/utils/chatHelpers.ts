/**
 * Creates a deterministic conversation ID based on two user IDs.
 * The IDs are sorted alphabetically to ensure the same ID regardless of order.
 */
export const getConversationId = (uid1: string, uid2: string): string => {
  return [uid1, uid2].sort().join('_');
};