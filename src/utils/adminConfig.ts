import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../services/firebaseConfig";

type GetAdminIdOptions = {
  excludeUserId?: string;
  allowExcludedFallback?: boolean;
};

let cachedAdminIds: string[] | null = null;

const normalizeAdminId = (value: unknown): string | null => {
  const normalized = String(value || "").trim();
  return normalized || null;
};

const uniqueAdminIds = (ids: (string | null | undefined)[]): string[] => {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
};

const pickAdminId = (
  adminIds: string[],
  { excludeUserId, allowExcludedFallback = false }: GetAdminIdOptions = {}
): string | null => {
  const excludedId = normalizeAdminId(excludeUserId);
  const preferredAdminId = adminIds.find((id) => id !== excludedId) || null;
  if (preferredAdminId) {
    return preferredAdminId;
  }
  if (allowExcludedFallback && excludedId && adminIds.includes(excludedId)) {
    return excludedId;
  }
  return adminIds[0] || null;
};

const loadAdminIds = async (): Promise<string[]> => {
  if (cachedAdminIds) return cachedAdminIds;

  const discoveredAdminIds: string[] = [];

  try {
    // Primary source (if configured): settings/admin { userId: "<adminUid>" }.
    const docSnap = await getDoc(doc(db, "settings", "admin"));
    if (docSnap.exists()) {
      const data = docSnap.data() as { userId?: unknown; userIds?: unknown };
      const configuredIds = Array.isArray(data.userIds)
        ? data.userIds.map(normalizeAdminId)
        : [normalizeAdminId(data.userId)];
      discoveredAdminIds.push(...uniqueAdminIds(configuredIds));
    }
  } catch {
    // Ignore missing permissions on /settings and fallback below.
  }

  // Fallback source: active admin user documents.
  try {
    const q = query(collection(db, "users"), where("role", "in", ["super_admin", "admin", "blood_admin", "funeral_admin"]), limit(10));
    const snapshot = await getDocs(q);
    discoveredAdminIds.push(...snapshot.docs.map((item) => item.id));
  } catch {
    // Keep silent to avoid noisy logs in production UI.
  }

  cachedAdminIds = uniqueAdminIds(discoveredAdminIds);
  return cachedAdminIds;
};

export const getAdminId = async (options: GetAdminIdOptions = {}): Promise<string | null> => {
  const adminIds = await loadAdminIds();
  return pickAdminId(adminIds, options);
};
