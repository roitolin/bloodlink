import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../services/firebaseConfig";
import { rankDonors, RankedDonor } from "./donorRanking";

type RequestForMatching = {
  id: string;
  bloodTypeNeeded?: string;
  city?: string;
  location?: { latitude?: number; longitude?: number } | null;
};

const haversineDistanceKm = (
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number }
) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(end.latitude - start.latitude);
  const dLon = toRad(end.longitude - start.longitude);
  const lat1 = toRad(start.latitude);
  const lat2 = toRad(end.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const buildDonorPerformanceMap = (requests: any[], donationHistory: any[]) => {
  const acceptedByMap = new Map<string, number>();
  const completedByMap = new Map<string, number>();

  requests.forEach((item) => {
    const acceptedBy = String(item?.acceptedBy || "").trim();
    if (!acceptedBy) return;
    acceptedByMap.set(acceptedBy, (acceptedByMap.get(acceptedBy) || 0) + 1);
  });

  donationHistory.forEach((item) => {
    const donorId = String(item?.donorId || "").trim();
    if (!donorId) return;
    completedByMap.set(donorId, (completedByMap.get(donorId) || 0) + 1);
  });

  const ids = new Set<string>([...acceptedByMap.keys(), ...completedByMap.keys()]);
  const map = new Map<
    string,
    { acceptedRequestCount: number; completedDonationCount: number; responseRatePercent: number }
  >();

  ids.forEach((id) => {
    const acceptedRequestCount = acceptedByMap.get(id) || 0;
    const completedDonationCount = completedByMap.get(id) || 0;
    const responseRatePercent =
      acceptedRequestCount > 0 ? (completedDonationCount / acceptedRequestCount) * 100 : completedDonationCount > 0 ? 100 : 0;
    map.set(id, {
      acceptedRequestCount,
      completedDonationCount,
      responseRatePercent: Math.max(0, Math.min(100, Math.round(responseRatePercent))),
    });
  });

  return map;
};

export const rankDonorsForRequest = (
  request: RequestForMatching,
  donors: RankedDonor[],
  donorPerformance: Map<string, { acceptedRequestCount: number; completedDonationCount: number; responseRatePercent: number }>
) => {
  const requestLocation =
    typeof request?.location?.latitude === "number" && typeof request?.location?.longitude === "number"
      ? { latitude: request.location.latitude, longitude: request.location.longitude }
      : null;

  const withDistanceAndPerformance = donors.map((donor) => {
    const donorLocation =
      typeof donor?.location?.latitude === "number" && typeof donor?.location?.longitude === "number"
        ? { latitude: donor.location.latitude, longitude: donor.location.longitude }
        : null;
    const distanceKm =
      requestLocation && donorLocation ? haversineDistanceKm(requestLocation, donorLocation) : undefined;

    const perf = donorPerformance.get(donor.id) || {
      acceptedRequestCount: 0,
      completedDonationCount: 0,
      responseRatePercent: 0,
    };

    return {
      ...donor,
      distanceKm,
      acceptedRequestCount: perf.acceptedRequestCount,
      completedDonationCount: perf.completedDonationCount,
      responseRatePercent: perf.responseRatePercent,
    };
  });

  return rankDonors(withDistanceAndPerformance, {
    selectedBloodType: request.bloodTypeNeeded || "",
    preferredCity: request.city || "",
  });
};

export const getTopMatchesForRequest = async (
  request: RequestForMatching,
  limit = 5,
  options?: { includePerformanceData?: boolean }
) => {
  const includePerformanceData = options?.includePerformanceData ?? true;

  const donorsSnap = await getDocs(
    query(
      collection(db, "users"),
      where("donorStatus", "==", "verified"),
      where("availabilityStatus", "==", "available"),
      where("bloodType", "!=", null)
    )
  );
  const donors = donorsSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) })) as RankedDonor[];

  if (!includePerformanceData) {
    return rankDonorsForRequest(request, donors, new Map()).slice(0, limit);
  }

  try {
    const [requestsSnap, historySnap] = await Promise.all([
      getDocs(collection(db, "requests")),
      getDocs(collection(db, "donation_history")),
    ]);

    const allRequests = requestsSnap.docs.map((item) => item.data() as any);
    const donationHistory = historySnap.docs.map((item) => item.data() as any);
    const donorPerformance = buildDonorPerformanceMap(allRequests, donationHistory);

    return rankDonorsForRequest(request, donors, donorPerformance).slice(0, limit);
  } catch (error: any) {
    if (error?.code === "permission-denied") {
      return rankDonorsForRequest(request, donors, new Map()).slice(0, limit);
    }
    throw error;
  }
};
