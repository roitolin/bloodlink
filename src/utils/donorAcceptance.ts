import { doc, getDoc } from "firebase/firestore";

const parseDate = (value: any): Date | null => {
  const parsed =
    value?.toDate?.() instanceof Date
      ? value.toDate()
      : value
      ? new Date(value)
      : null;

  if (!parsed || Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

export type DonorAcceptanceEligibility =
  | { ok: true; userData: any }
  | {
      ok: false;
      title: string;
      message: string;
      actionLabel?: string;
      actionKind?: "open_profile";
    };

type EnsureDonorCanAcceptRequestParams = {
  db: any;
  userId: string;
};

export async function ensureDonorCanAcceptRequest({
  db,
  userId,
}: EnsureDonorCanAcceptRequestParams): Promise<DonorAcceptanceEligibility> {
  const userSnap = await getDoc(doc(db, "users", userId));

  if (!userSnap.exists()) {
    return {
      ok: false,
      title: "Profile Required",
      message: "Please complete your donor profile first before accepting a blood request.",
    };
  }

  const userData = userSnap.data();
  const donorStatus = String(userData?.donorStatus || "none").toLowerCase();
  const availabilityStatus = String(userData?.availabilityStatus || "unavailable").toLowerCase();
  const cooldownUntil = parseDate(userData?.donationCooldownUntil);

  if (donorStatus !== "verified") {
    if (donorStatus === "pending") {
      return {
        ok: false,
        title: "Verification In Review",
        message: "Your donor verification is still under admin review. You can accept requests once your account is verified.",
      };
    }

    if (donorStatus === "rejected") {
      return {
        ok: false,
        title: "Verification Needed",
        message: "Your donor verification was rejected. Please update your donor details and submit again.",
        actionLabel: "Open Profile",
        actionKind: "open_profile",
      };
    }

    return {
      ok: false,
      title: "Not Verified Yet",
      message: "Only verified donors can accept blood requests.",
      actionLabel: "Open Profile",
      actionKind: "open_profile",
    };
  }

  if (cooldownUntil && cooldownUntil.getTime() > Date.now()) {
    return {
      ok: false,
      title: "Donation Cooldown Active",
      message: `You can accept requests again after ${cooldownUntil.toLocaleString()}.`,
    };
  }

  if (availabilityStatus !== "available") {
    return {
      ok: false,
      title: "Availability Is Off",
      message: "You are verified, but your donor availability is currently OFF. Turn it on in your profile before accepting requests.",
      actionLabel: "Open Profile",
      actionKind: "open_profile",
    };
  }

  return { ok: true, userData };
}
