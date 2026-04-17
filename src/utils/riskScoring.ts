type AbuseReportLike = {
  id: string;
  reporterId?: string;
  targetUserId?: string;
  status?: string;
  reason?: string;
  createdAt?: any;
};

type BlockLike = {
  id: string;
  blockerId?: string;
  blockedId?: string;
  active?: boolean;
};

type RequestLike = {
  id: string;
  requesterId?: string;
  status?: string;
  createdAt?: any;
  urgency?: string;
};

type UserLike = {
  id: string;
  fullName?: string;
  photoURL?: string;
  contactNumber?: string;
  donorStatus?: string;
  email?: string;
  disabled?: boolean;
};

export type RiskProfile = {
  userId: string;
  score: number;
  level: "low" | "medium" | "high";
  reasons: string[];
  openReports: number;
  activeBlocksAsBlocker: number;
  activeBlocksAsTarget: number;
  suspiciousRequests: number;
};

const pushReason = (reasons: string[], text: string) => {
  if (!reasons.includes(text)) reasons.push(text);
};

export const buildRiskProfiles = (input: {
  reports: AbuseReportLike[];
  blocks: BlockLike[];
  requests: RequestLike[];
  users: UserLike[];
}) => {
  const { reports, blocks, requests, users } = input;
  const byUser = new Map<string, RiskProfile>();
  const usersById = new Map(users.map((item) => [item.id, item]));

  const ensureProfile = (userId: string) => {
    const existing = byUser.get(userId);
    if (existing) return existing;
    const created: RiskProfile = {
      userId,
      score: 0,
      level: "low",
      reasons: [],
      openReports: 0,
      activeBlocksAsBlocker: 0,
      activeBlocksAsTarget: 0,
      suspiciousRequests: 0,
    };
    byUser.set(userId, created);
    return created;
  };

  reports.forEach((report) => {
    const targetUserId = String(report.targetUserId || "").trim();
    if (!targetUserId) return;

    const profile = ensureProfile(targetUserId);
    const status = String(report.status || "open").toLowerCase();
    const reason = String(report.reason || "").toLowerCase();

    if (status === "open") {
      profile.score += 20;
      profile.openReports += 1;
      pushReason(profile.reasons, "Open abuse reports");
    } else if (status === "reviewing") {
      profile.score += 12;
      pushReason(profile.reasons, "Reports under review");
    } else if (status === "resolved") {
      profile.score += 4;
      pushReason(profile.reasons, "Previously resolved reports");
    }

    if (reason.includes("fake")) {
      profile.score += 8;
      pushReason(profile.reasons, "Fake information reports");
    }
    if (reason.includes("spam")) {
      profile.score += 6;
      pushReason(profile.reasons, "Spam behavior reports");
    }
  });

  blocks.forEach((block) => {
    if (block.active === false) return;

    const blockerId = String(block.blockerId || "").trim();
    const blockedId = String(block.blockedId || "").trim();

    if (blockerId) {
      const profile = ensureProfile(blockerId);
      profile.activeBlocksAsBlocker += 1;
      if (profile.activeBlocksAsBlocker >= 3) {
        profile.score += 10;
        pushReason(profile.reasons, "Repeatedly blocks many users");
      } else {
        profile.score += 3;
      }
    }

    if (blockedId) {
      const profile = ensureProfile(blockedId);
      profile.activeBlocksAsTarget += 1;
      profile.score += 7;
      pushReason(profile.reasons, "Frequently blocked by others");
    }
  });

  const now = Date.now();
  requests.forEach((request) => {
    const requesterId = String(request.requesterId || "").trim();
    if (!requesterId) return;

    const createdAtMillis =
      typeof request.createdAt?.toDate === "function"
        ? request.createdAt.toDate().getTime()
        : request.createdAt
        ? new Date(request.createdAt).getTime()
        : 0;
    const isRecent = createdAtMillis > 0 && now - createdAtMillis <= 48 * 60 * 60 * 1000;
    if (!isRecent) return;

    const profile = ensureProfile(requesterId);
    const status = String(request.status || "").toLowerCase();
    const urgency = String(request.urgency || "").toLowerCase();

    if (status === "pending" && urgency === "critical") {
      profile.suspiciousRequests += 1;
    }
  });

  byUser.forEach((profile, userId) => {
    if (profile.suspiciousRequests >= 3) {
      profile.score += 18;
      pushReason(profile.reasons, "Multiple critical pending requests in short time");
    } else if (profile.suspiciousRequests >= 2) {
      profile.score += 10;
      pushReason(profile.reasons, "Frequent high-urgency pending requests");
    }

    const user = usersById.get(userId);
    if (user) {
      const missingIdentityFields = [user.fullName, user.contactNumber].filter((item) => !String(item || "").trim()).length;
      if (missingIdentityFields >= 2) {
        profile.score += 8;
        pushReason(profile.reasons, "Profile missing core identity fields");
      }
      if (user.donorStatus === "verified" && !user.photoURL) {
        profile.score += 4;
        pushReason(profile.reasons, "Verified donor without profile photo");
      }
      if (user.disabled) {
        profile.score += 12;
        pushReason(profile.reasons, "Account has been disabled by admin");
      }
    }

    profile.score = Math.max(0, Math.min(100, Math.round(profile.score)));
    profile.level = profile.score >= 70 ? "high" : profile.score >= 40 ? "medium" : "low";
  });

  return Array.from(byUser.values()).sort((a, b) => b.score - a.score);
};

