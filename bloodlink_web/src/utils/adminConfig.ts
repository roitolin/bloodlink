import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

type GetAdminIdOptions = {
  excludeUserId?: string
  allowExcludedFallback?: boolean
}

let cachedAdminIds: string[] | null = null

function normalizeAdminId(value: unknown): string | null {
  const normalized = String(value || '').trim()
  return normalized || null
}

function uniqueAdminIds(ids: Array<string | null | undefined>): string[] {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))))
}

function pickAdminId(
  adminIds: string[],
  { excludeUserId, allowExcludedFallback = false }: GetAdminIdOptions = {},
): string | null {
  const excludedId = normalizeAdminId(excludeUserId)
  const preferredAdminId = adminIds.find((id) => id !== excludedId) || null
  if (preferredAdminId) return preferredAdminId
  if (allowExcludedFallback && excludedId && adminIds.includes(excludedId)) {
    return excludedId
  }
  return adminIds[0] || null
}

async function loadAdminIds(): Promise<string[]> {
  if (cachedAdminIds) return cachedAdminIds

  const discoveredAdminIds: string[] = []

  try {
    const settingsSnap = await getDoc(doc(db, 'settings', 'admin'))
    if (settingsSnap.exists()) {
      const data = settingsSnap.data() as { userId?: unknown; userIds?: unknown }
      const configuredIds = Array.isArray(data.userIds)
        ? data.userIds.map(normalizeAdminId)
        : [normalizeAdminId(data.userId)]
      discoveredAdminIds.push(...uniqueAdminIds(configuredIds))
    }
  } catch {
    // Fall back to the first admin user when settings are not readable.
  }

  try {
    const adminQuery = query(collection(db, 'users'), where('role', 'in', ['super_admin', 'admin', 'blood_admin', 'funeral_admin']), limit(10))
    const snapshot = await getDocs(adminQuery)
    discoveredAdminIds.push(...snapshot.docs.map((item) => item.id))
  } catch {
    // Keep silent so the UI can show a friendly message instead.
  }

  cachedAdminIds = uniqueAdminIds(discoveredAdminIds)
  return cachedAdminIds
}

export async function getAdminId(options: GetAdminIdOptions = {}): Promise<string | null> {
  const adminIds = await loadAdminIds()
  return pickAdminId(adminIds, options)
}
