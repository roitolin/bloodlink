type Coordinates = { latitude: number; longitude: number };

export type RankedDonor = {
  id: string;
  fullName?: string;
  bloodType?: string;
  city?: string;
  donorStatus?: string;
  availabilityStatus?: string;
  medicalCertificateURL?: string;
  availableSince?: any;
  location?: Coordinates;
  distanceKm?: number;
  acceptedRequestCount?: number;
  completedDonationCount?: number;
  responseRatePercent?: number;
  smartRankScore?: number;
  smartRankReasons?: string[];
  smartRankTier?: "excellent" | "good" | "fair";
};

type RankingOptions = {
  selectedBloodType?: string;
  preferredCity?: string;
  now?: Date;
};

const normalize = (value: string | undefined | null) => String(value || "").trim().toLowerCase();

export const rankDonors = (donors: RankedDonor[], options: RankingOptions = {}): RankedDonor[] => {
  const preferredCity = normalize(options.preferredCity);
  const selectedBloodType = normalize(options.selectedBloodType);
  const now = options.now || new Date();

  const ranked = donors.map((donor) => {
    let score = 0;
    const reasons: string[] = [];

    if (selectedBloodType) {
      if (normalize(donor.bloodType) === selectedBloodType) {
        score += 18;
        reasons.push("Blood type match");
      }
    } else {
      score += 6;
    }

    if (normalize(donor.donorStatus) === "verified") {
      score += 22;
      reasons.push("Verified donor");
    }

    if (normalize(donor.availabilityStatus) === "available") {
      score += 12;
      reasons.push("Currently available");
    }

    if (donor.medicalCertificateURL) {
      score += 10;
      reasons.push("Medical certificate on file");
    }

    if (preferredCity && normalize(donor.city) === preferredCity) {
      score += 16;
      reasons.push("Same city or municipality");
    }

    if (typeof donor.distanceKm === "number" && Number.isFinite(donor.distanceKm)) {
      const distanceScore = Math.max(0, 28 - donor.distanceKm * 1.4);
      score += distanceScore;
      if (donor.distanceKm <= 5) {
        reasons.push("Very close distance");
      } else if (donor.distanceKm <= 15) {
        reasons.push("Nearby donor");
      }
    }

    const availableSinceDate =
      donor.availableSince?.toDate?.() instanceof Date
        ? donor.availableSince.toDate()
        : donor.availableSince
        ? new Date(donor.availableSince)
        : null;

    if (availableSinceDate && !Number.isNaN(availableSinceDate.getTime())) {
      const hoursAvailable = Math.max(0, (now.getTime() - availableSinceDate.getTime()) / 3600000);
      if (hoursAvailable <= 24) {
        score += 8;
        reasons.push("Recently available");
      } else if (hoursAvailable <= 72) {
        score += 4;
      }
    }

    if (typeof donor.completedDonationCount === "number" && donor.completedDonationCount > 0) {
      score += Math.min(12, donor.completedDonationCount * 2);
      reasons.push("Strong completion history");
    }

    if (typeof donor.responseRatePercent === "number" && donor.responseRatePercent > 0) {
      if (donor.responseRatePercent >= 80) {
        score += 12;
        reasons.push("High response reliability");
      } else if (donor.responseRatePercent >= 60) {
        score += 8;
        reasons.push("Reliable response history");
      } else if (donor.responseRatePercent >= 40) {
        score += 4;
      }
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    const smartRankTier: "excellent" | "good" | "fair" =
      score >= 75 ? "excellent" : score >= 50 ? "good" : "fair";

    return {
      ...donor,
      smartRankScore: score,
      smartRankReasons: reasons.slice(0, 3),
      smartRankTier,
    };
  });

  ranked.sort((a, b) => {
    const scoreDiff = (b.smartRankScore || 0) - (a.smartRankScore || 0);
    if (scoreDiff !== 0) return scoreDiff;

    const distA = typeof a.distanceKm === "number" ? a.distanceKm : Number.MAX_SAFE_INTEGER;
    const distB = typeof b.distanceKm === "number" ? b.distanceKm : Number.MAX_SAFE_INTEGER;
    return distA - distB;
  });

  return ranked;
};
