import {
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";

export type RateLimitAction =
  | "chat_message"
  | "support_message"
  | "abuse_report"
  | "create_request";

type RateLimitPolicy = {
  max: number;
  windowMs: number;
};

const RATE_LIMIT_POLICIES: Record<RateLimitAction, RateLimitPolicy> = {
  chat_message: { max: 12, windowMs: 60_000 },
  support_message: { max: 3, windowMs: 5 * 60_000 },
  abuse_report: { max: 3, windowMs: 10 * 60_000 },
  create_request: { max: 4, windowMs: 60 * 60_000 },
};

export class RateLimitExceededError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`Too many requests. Please try again in ${retryAfterSeconds}s.`);
    this.name = "RateLimitExceededError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const sanitizeScope = (value?: string): string => {
  const trimmed = String(value || "global").trim().toLowerCase();
  return trimmed.replace(/[^a-z0-9_-]/g, "-").slice(0, 64) || "global";
};

const makeRateLimitDocId = (userId: string, action: RateLimitAction, scope?: string): string => {
  return `${userId}_${action}_${sanitizeScope(scope)}`;
};

export const consumeRateLimit = async (
  db: Firestore,
  userId: string,
  action: RateLimitAction,
  scope?: string
) => {
  const policy = RATE_LIMIT_POLICIES[action];
  const now = Date.now();
  const docId = makeRateLimitDocId(userId, action, scope);
  const rateLimitRef = doc(db, "rate_limits", docId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(rateLimitRef);
    const data = snap.data() as { count?: number; resetAtMs?: number } | undefined;

    const existingCount = Number(data?.count || 0);
    const resetAtMs = Number(data?.resetAtMs || 0);

    if (!snap.exists()) {
      tx.set(
        rateLimitRef,
        {
          userId,
          action,
          scope: sanitizeScope(scope),
          count: 1,
          resetAtMs: now + policy.windowMs,
          windowMs: policy.windowMs,
          max: policy.max,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: false }
      );
      return;
    }

    if (now >= resetAtMs) {
      tx.update(rateLimitRef, {
        count: 1,
        resetAtMs: now + policy.windowMs,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (existingCount >= policy.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - now) / 1000));
      throw new RateLimitExceededError(retryAfterSeconds);
    }

    tx.update(rateLimitRef, {
      count: existingCount + 1,
      updatedAt: serverTimestamp(),
    });
  });
};

export const isRateLimitError = (error: unknown): error is RateLimitExceededError => {
  return error instanceof RateLimitExceededError;
};
